const fs = require("fs")
const babylon = require("babylon")
const traverse = require("babel-traverse").default

// Take path to a file and extract its dependencies
function createAsset(filename) {
 const content = fs.readFileSync(filename, "utf-8")

 const ast = babylon.parse(content, { sourceType: "module" })
 traverse(ast, {
  ImportDeclaration: ({ node }) => {},
 })
}

createAsset("./src/entry.js")
