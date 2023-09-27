import { readdir } from "node:fs/promises";
import path from "path";

interface FileInfo {
  name: string;
  fullPath: string;
  pathFromBase: string;
}
interface DirInfo {
  name: string;
  fullPath: string;
  pathFromBase: string;
}

interface DirListing {
  dirPath: string;
  files: FileInfo[];
  dirs: DirInfo[];
}

export async function makeDirListing(
  dirPath: string,
  recursive: boolean
): Promise<DirListing> {
  const res: DirListing = { dirPath, files: [], dirs: [] };
  const dirsToProcess = [dirPath];
  while (dirsToProcess.length > 0) {
    const curDir: string = <string>dirsToProcess.shift();
    const dirEnts = await readdir(curDir, { withFileTypes: true });
    for (const dirEnt of dirEnts) {
      const fullPath = path.join(curDir, dirEnt.name);
      console.assert(fullPath.startsWith(dirPath));
      const pathFromBase = fullPath.substring(dirPath.length + 1);
      if (dirEnt.isDirectory()) {
        res.dirs.push({
          name: dirEnt.name,
          fullPath,
          pathFromBase,
        });

        if (recursive) {
          dirsToProcess.push(fullPath);
        }
      } else {
        res.files.push({
          name: dirEnt.name,
          fullPath,
          pathFromBase,
        });
      }
    }
  }
  return res;
}
