const fs = require('fs');

let content = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

// Function to remove if (isDemoMode) { ... } else { ... }
// Since there's also return inside if, some are just if (isDemoMode) { ... return; }
// Also we need to remove isDemoMode from the useState and context.

function removeDemoBlocks(code) {
  let result = code;
  // Replace `if (isDemoMode) { ... return; }` using basic block matching
  // It's tricky to do with regex, but we can do a simple parser.
  
  // Actually, wait, let's just use regex to replace `isDemoMode` with `false`.
  // Wait, I can just use a regex for the state initialization:
  result = result.replace(/const \[isDemoMode, setIsDemoMode\] = useState<boolean>\([^;]+;/g, 'const [isDemoMode, setIsDemoMode] = useState<boolean>(false);');
  
  return result;
}

const cleaned = removeDemoBlocks(content);
fs.writeFileSync('src/context/AppContext.tsx', cleaned);
console.log('Done!');
