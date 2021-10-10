const fs = require("fs")
const babylon = require("babylon")
const traverse = require("babel-traverse").default

let ID = 0

// Take path to a file and extract its dependencies
function createAsset(filename) {
 const content = fs.readFileSync(filename, "utf-8")

 const ast = babylon.parse(content, { sourceType: "module" })

 const dependencies = []

 traverse(ast, {
  ImportDeclaration: ({ node }) => {
   dependencies.push(node.source.value)
  },
 })

 const id = ID++

 return {
  id,
  filename,
  dependencies,
 }
}

const mainAsset = createAsset("./src/entry.js")
