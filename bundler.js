const fs = require("fs");
const babylon = require("babylon");
const traverse = require("babel-traverse").default;
const path = require("path");
const babel = require("babel-core");
const UglifyJs = require("uglify-js");
const { fileExtensionRegExp } = require("./src/constants.js");

let ID = 0;

const plugins = [(code) => UglifyJs.minify(code).code];

const fileExtensionPrecedence = ["ts", "js"];

function resolveFileNamesWithNoExtension(fileName) {
  const fileExtensionMatch = fileName.match(fileExtensionRegExp);
  let resolvedFileName = fileName;
  if (!fileExtensionMatch) {
    for (let extension of fileExtensionPrecedence) {
      const probableFilename = `${fileName}.${extension}`;
      if (fs.existsSync(probableFilename)) {
        resolvedFileName = probableFilename;
        break;
      }
    }
  }
  if (!fileExtensionMatch && resolvedFileName === fileName)
    throw new Error(`File not found: ${fileName}`);
  return resolvedFileName;
}

// Take path to a file and extract its dependencies
function createAsset(fileName) {
  const resolvedFileName = resolveFileNamesWithNoExtension(fileName);

  const content = fs.readFileSync(resolvedFileName, "utf-8");

  const ast = babylon.parse(content, { sourceType: "module" });

  const dependencies = [];

  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      dependencies.push(node.source.value);
    },
  });

  const id = ID++;
  const { code } = babel.transformFromAst(ast, null, {
    presets: ["env"],
  });

  return {
    id,
    fileName,
    dependencies,
    code: plugins.reduce(
      (finalCode, currentPlugin) => currentPlugin(finalCode),
      code
    ),
  };
}

function createGraph(entry) {
  const mainAsset = createAsset(entry);

  const queue = [mainAsset];

  for (const asset of queue) {
    const dirname = path.dirname(asset.fileName);
    asset.mapping = {};

    asset.dependencies.forEach((relativePath) => {
      const absolutePath = path.join(dirname, relativePath);
      const child = createAsset(absolutePath);
      asset.mapping[relativePath] = child.id;
      queue.push(child);
    });
  }
  return queue;
}

function bundle(graph) {
  let modules = "";

  graph.forEach(
    (mod) =>
      (modules += `${mod.id}: [
     function (require, module, exports) {
        ${mod.code}
     },
     ${JSON.stringify(mod.mapping)}
    ],`)
  );

  const result = UglifyJs.minify(`
        (function(modules) {
            function require(id) {
               const [fn, mapping] = modules[id];

               function localRequire(relativePath) {
                  return require(mapping[relativePath]);
               }

               const module = { exports: {} };

               fn(localRequire, module, module.exports);

               return module.exports;
            }

            require(0);
        })({${modules}})
    `).code;

  return result;
}

const graph = createGraph("./src/entry");
const result = bundle(graph);
console.log(result);
