import path from 'path';
import glob from 'glob';
import fs from 'fs';
import matter from 'gray-matter';
import { Options } from './interfaces/options';
import { FolderStructure } from './interfaces/folderStructure';
import { FileStructure } from './interfaces/fileStructure';

/**
 * Normalize pathing so that `\` is replaced with `/`.
 *
 * @param {string} path
 * @return {*}
 */
function normalizePath(path: string) {
    return path.replace(/\\/gm, '/');
}

/**
 * Capitalize the first letter of a string.
 *
 * @param {string} value
 * @return {*}
 */
function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Get all files for a single directory.
 * Orders files by order front matter.
 *
 * @param {string} folderPath
 * @return {Array<FileStructure>}
 */
function filesAndOrder(folderPath: string, filesToIgnore: Array<string> = []): Array<FileStructure> {
    if (typeof filesToIgnore === 'string') {
        filesToIgnore = [filesToIgnore];
    }

    let finalPath: string;
    if (!folderPath.includes(normalizePath(process.cwd()))) {
        finalPath = normalizePath(path.join(process.cwd(), folderPath, '/*.md'));
    } else {
        finalPath = normalizePath(path.join(folderPath, '/*.md'));
    }

    const files: Array<string> = glob.sync(finalPath);

    let navigation = [];
    for (const file of files) {
        if (file.includes('index.md')) {
            continue;
        }
        let shouldSkip = false;
        for (const partialToIgnore of filesToIgnore) {
            const containsText = file.match(partialToIgnore);
            if (!containsText) {
                continue;
            }

            console.log(`Ignored File | ${file}`);
            shouldSkip = true;
            break;
        }

        if (shouldSkip) {
            continue;
        }

        const fileData = fs.readFileSync(file).toString();
        const matterData = matter(fileData);

        if (typeof matterData.data.title === 'undefined') {
            console.warn(`Missing Title Front Matter | ${file}`);
        }

        const link = file.replace(normalizePath(path.join(process.cwd(), 'docs')), '');
        const data = { ...matterData.data, text: matterData.data.title, link };
        if (typeof data['order'] === 'undefined') {
            data['order'] = 0;
        }

        navigation.push(data);
    }

    const sortedResults = navigation.sort((a, b) => {
        return a.order - b.order;
    });

    return sortedResults;
}

/**
 * Recursively obtain all folders and files.
 * Keep folder structure and automatically organize files by order front matter.
 *
 * @param {string} folderPath
 * @param {Options} [options={}]
 * @return {Array<FolderStructure>}
 */
function foldersAndOrder(folderPath: string, options: Options = {}): Array<FolderStructure> {
    let startPath: string;
    console.log('foldersAndOrder: ', folderPath);

    if (!folderPath.includes(normalizePath(process.cwd()))) {
        startPath = normalizePath(path.join(process.cwd(), folderPath));
    } else {
        startPath = folderPath;
    }

    const folders = fs
        .readdirSync(startPath, {
            withFileTypes: true,
        })
        .filter((f) => f.isDirectory);

    let objects: Array<FolderStructure> = [];
    for (let folder of folders) {
        const nextPath = normalizePath(path.join(startPath, folder.name));
        const indexPath = normalizePath(path.join(nextPath, 'index.md'));
        if (!fs.existsSync(indexPath)) {
            continue;
        }
        const fileIndexData = fs.readFileSync(indexPath).toString();
        const matterData = matter(fileIndexData);

        if (typeof matterData.data.title === 'undefined') {
            console.warn(`Missing Title Front Matter | ${indexPath}`);
            continue;
        }

        objects.push({
            text: matterData.data.title,
            items: [
                ...filesAndOrder(nextPath, options.partialFileNamesToIgnore ? options.partialFileNamesToIgnore : []),
                ...foldersAndOrder(nextPath, options),
            ].sort((a, b) => {
                return a.order - b.order;
            }),
            order: matterData.data.order || 0,
            collapsible: options.collapsible === false ? false : true, // Default to `True`
            collapsed: options.collapsed === true ? true : false, // Default to `False`
        });

        objects = [...objects];
    }

    const sortedResults = objects.sort((a, b) => {
        return a.order - b.order;
    });

    return sortedResults;
}

export const SidebarBuilder = {
    get: {
        filesAndOrder,
        foldersAndOrder,
    },
    utility: {
        normalizePath,
    },
};

export default SidebarBuilder;
