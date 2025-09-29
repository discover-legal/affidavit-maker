#!/usr/bin/env node

/**
 * Codebase Analyzer for Affidavit App Issues
 * 
 * Usage: 
 * 1. Save this file as analyze-codebase.js in your project root
 * 2. Run: node analyze-codebase.js
 * 
 * This will find:
 * - Files handling document save functionality
 * - Files rendering facts with potential bullet point issues
 * - The exact patterns causing both problems
 */

const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Configuration
const config = {
    srcDirs: ['src', 'app', 'components', 'pages', 'lib', 'utils', 'contexts', 'hooks'],
    fileExtensions: ['.js', '.jsx', '.ts', '.tsx'],
    excludeDirs: ['node_modules', '.git', 'build', 'dist', '.next', 'coverage'],
    maxFileSize: 1024 * 1024 * 2 // 2MB max file size to analyze
};

// Results storage
const results = {
    saveIssue: {
        files: [],
        patterns: []
    },
    displayIssue: {
        files: [],
        patterns: []
    },
    contextFiles: [],
    factComponents: [],
    apiCalls: [],
    suggestions: []
};

// Helper function to check if path should be excluded
function shouldExclude(filePath) {
    return config.excludeDirs.some(dir => filePath.includes(dir));
}

// Helper function to get all files recursively
function getAllFiles(dirPath, arrayOfFiles = []) {
    if (!fs.existsSync(dirPath)) return arrayOfFiles;
    
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        
        if (shouldExclude(fullPath)) return;
        
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            const ext = path.extname(fullPath);
            if (config.fileExtensions.includes(ext)) {
                arrayOfFiles.push(fullPath);
            }
        }
    });
    
    return arrayOfFiles;
}

// Analyze a single file
function analyzeFile(filePath) {
    try {
        const stats = fs.statSync(filePath);
        if (stats.size > config.maxFileSize) return;
        
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        const relPath = path.relative(process.cwd(), filePath);
        
        // Check for DocumentContext
        if (content.includes('DocumentContext') || 
            content.includes('documentContext') ||
            fileName.toLowerCase().includes('documentcontext')) {
            results.contextFiles.push({
                path: relPath,
                hasProvider: content.includes('Provider'),
                hasCreateContext: content.includes('createContext'),
                hasSaveFunction: content.includes('save') && content.includes('document')
            });
        }
        
        // Check for save-related patterns
        if (content.includes('/api/documents/save') || 
            content.includes('saveDocument') ||
            (content.includes('save') && content.includes('affidavit'))) {
            
            // Look for the problematic pattern where affidavitData is sent directly
            if (content.includes('affidavitData') && 
                (content.includes('fetch') || content.includes('axios') || content.includes('apiRequest'))) {
                
                // Extract the relevant code section
                const lines = content.split('\n');
                const relevantLines = [];
                
                lines.forEach((line, index) => {
                    if (line.includes('fetch') || 
                        line.includes('body:') || 
                        line.includes('data:') ||
                        line.includes('affidavitData')) {
                        relevantLines.push({
                            lineNumber: index + 1,
                            code: line.trim()
                        });
                    }
                });
                
                results.saveIssue.files.push({
                    path: relPath,
                    lines: relevantLines,
                    hasAffidavitData: true,
                    pattern: 'Direct affidavitData in request'
                });
            }
        }
        
        // Check for API endpoint definitions (backend)
        if (content.includes("'/api/documents/save'") || 
            content.includes('"/api/documents/save"') ||
            content.includes('`/api/documents/save`')) {
            results.apiCalls.push({
                path: relPath,
                isBackend: content.includes('router.') || content.includes('app.') || content.includes('export async function')
            });
        }
        
        // Check for Facts/Validation components
        if (fileName.toLowerCase().includes('fact') || 
            fileName.toLowerCase().includes('validation') ||
            content.includes('suggestions')) {
            
            results.factComponents.push({
                path: relPath,
                fileName: fileName,
                hasSuggestions: content.includes('suggestions'),
                hasMap: content.includes('.map'),
                hasBullet: content.includes('•')
            });
            
            // Check for problematic array patterns on suggestions
            const problematicPatterns = [
                /\[\.\.\.(\w*[Ss]uggestions?\w*)\]/g,  // [...suggestions]
                /Array\.from\((\w*[Ss]uggestions?\w*)\)/g,  // Array.from(suggestions)
                /(\w*[Ss]uggestions?\w*)\.split\(['"]{0,2}\)/g,  // suggestions.split('')
                /(\w*[Ss]uggestions?\w*)\.split\(['"]{2}\)/g,  // suggestions.split("")
                /\{(\w*[Ss]uggestions?\w*)\.map\(/g,  // {suggestions.map(
                /\{Array\.from\((\w*[Ss]uggestions?\w*)\)\.map/g  // {Array.from(suggestions).map
            ];
            
            problematicPatterns.forEach(pattern => {
                const matches = content.match(pattern);
                if (matches) {
                    const lines = content.split('\n');
                    lines.forEach((line, index) => {
                        if (pattern.test(line)) {
                            results.displayIssue.patterns.push({
                                path: relPath,
                                lineNumber: index + 1,
                                pattern: matches[0],
                                code: line.trim()
                            });
                        }
                    });
                }
            });
        }
        
        // Look for suggestion rendering specifically
        if (content.includes('suggestions') && (content.includes('.map') || content.includes('Array.from'))) {
            const lines = content.split('\n');
            lines.forEach((line, index) => {
                if ((line.includes('suggestions') && line.includes('.map')) ||
                    (line.includes('suggestions') && line.includes('Array.from'))) {
                    results.suggestions.push({
                        path: relPath,
                        lineNumber: index + 1,
                        code: line.trim()
                    });
                }
            });
        }
        
    } catch (error) {
        // Silent fail for files we can't read
    }
}

// Main analysis function
function runAnalysis() {
    console.log(`${colors.bright}${colors.blue}=== AFFIDAVIT APP CODEBASE ANALYZER ===${colors.reset}\n`);
    
    // Find all source directories
    const dirsToScan = config.srcDirs.filter(dir => fs.existsSync(dir));
    
    if (dirsToScan.length === 0) {
        console.log(`${colors.yellow}No source directories found. Scanning current directory...${colors.reset}`);
        dirsToScan.push('.');
    }
    
    console.log(`${colors.cyan}Scanning directories:${colors.reset} ${dirsToScan.join(', ')}\n`);
    
    // Get all files
    let allFiles = [];
    dirsToScan.forEach(dir => {
        allFiles = allFiles.concat(getAllFiles(dir));
    });
    
    console.log(`Found ${colors.green}${allFiles.length}${colors.reset} files to analyze\n`);
    
    // Analyze each file
    let analyzed = 0;
    allFiles.forEach(file => {
        analyzeFile(file);
        analyzed++;
        if (analyzed % 100 === 0) {
            process.stdout.write(`\rAnalyzed ${analyzed}/${allFiles.length} files...`);
        }
    });
    
    console.log(`\r${colors.green}✓${colors.reset} Analyzed ${analyzed} files\n`);
    
    // Report findings
    console.log(`${colors.bright}${colors.magenta}=== ANALYSIS RESULTS ===${colors.reset}\n`);
    
    // 1. Save Issue Analysis
    console.log(`${colors.bright}1. SAVE ISSUE ANALYSIS:${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    if (results.contextFiles.length > 0) {
        console.log(`\n${colors.green}DocumentContext files found:${colors.reset}`);
        results.contextFiles.forEach(file => {
            console.log(`  📁 ${file.path}`);
            if (file.hasSaveFunction) {
                console.log(`     ${colors.yellow}⚠️  Contains save function${colors.reset}`);
            }
        });
    }
    
    if (results.saveIssue.files.length > 0) {
        console.log(`\n${colors.red}⚠️  Potential save issue locations:${colors.reset}`);
        results.saveIssue.files.forEach(file => {
            console.log(`  📁 ${colors.yellow}${file.path}${colors.reset}`);
            console.log(`     Pattern: ${file.pattern}`);
            if (file.lines && file.lines.length > 0) {
                console.log(`     Key lines:`);
                file.lines.slice(0, 3).forEach(line => {
                    console.log(`       Line ${line.lineNumber}: ${line.code.substring(0, 60)}...`);
                });
            }
        });
    }
    
    if (results.apiCalls.length > 0) {
        console.log(`\n${colors.green}API save endpoints:${colors.reset}`);
        results.apiCalls.forEach(file => {
            console.log(`  📁 ${file.path} ${file.isBackend ? '(Backend)' : '(Frontend)'}`);
        });
    }
    
    // 2. Display Issue Analysis
    console.log(`\n${colors.bright}2. DISPLAY ISSUE ANALYSIS:${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    if (results.factComponents.length > 0) {
        console.log(`\n${colors.green}Fact/Validation components:${colors.reset}`);
        results.factComponents.forEach(file => {
            console.log(`  📁 ${file.path}`);
            const flags = [];
            if (file.hasSuggestions) flags.push('has suggestions');
            if (file.hasMap) flags.push('uses .map()');
            if (file.hasBullet) flags.push('contains •');
            if (flags.length > 0) {
                console.log(`     Flags: ${flags.join(', ')}`);
            }
        });
    }
    
    if (results.displayIssue.patterns.length > 0) {
        console.log(`\n${colors.red}🐛 FOUND PROBLEMATIC PATTERNS:${colors.reset}`);
        results.displayIssue.patterns.forEach(pattern => {
            console.log(`  📁 ${colors.yellow}${pattern.path}${colors.reset}`);
            console.log(`     Line ${pattern.lineNumber}: ${colors.red}${pattern.pattern}${colors.reset}`);
            console.log(`     Code: ${pattern.code.substring(0, 60)}...`);
        });
    }
    
    if (results.suggestions.length > 0) {
        console.log(`\n${colors.yellow}Suggestion rendering locations:${colors.reset}`);
        const uniquePaths = [...new Set(results.suggestions.map(s => s.path))];
        uniquePaths.forEach(path => {
            const instances = results.suggestions.filter(s => s.path === path);
            console.log(`  📁 ${path}`);
            instances.slice(0, 3).forEach(instance => {
                console.log(`     Line ${instance.lineNumber}: ${instance.code.substring(0, 50)}...`);
            });
        });
    }
    
    // 3. Recommendations
    console.log(`\n${colors.bright}${colors.blue}=== RECOMMENDATIONS ===${colors.reset}\n`);
    
    if (results.saveIssue.files.length > 0) {
        console.log(`${colors.yellow}1. SAVE ISSUE:${colors.reset}`);
        console.log(`   Check these files where affidavitData is being sent directly:`);
        results.saveIssue.files.forEach(file => {
            console.log(`   - ${file.path}`);
        });
        console.log(`\n   ${colors.green}Fix:${colors.reset} Transform affidavitData to {title, content, documentId} before sending\n`);
    }
    
    if (results.displayIssue.patterns.length > 0) {
        console.log(`${colors.yellow}2. DISPLAY ISSUE:${colors.reset}`);
        console.log(`   Fix these locations where strings are being spread/split:`);
        results.displayIssue.patterns.forEach(pattern => {
            console.log(`   - ${pattern.path}:${pattern.lineNumber}`);
        });
        console.log(`\n   ${colors.green}Fix:${colors.reset} Remove array operations on suggestion strings\n`);
    }
    
    // 4. Export results
    const outputFile = 'codebase-analysis-results.json';
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`${colors.green}✓${colors.reset} Full results saved to: ${colors.cyan}${outputFile}${colors.reset}\n`);
    
    // 5. Next steps
    console.log(`${colors.bright}${colors.magenta}=== NEXT STEPS ===${colors.reset}\n`);
    console.log(`1. Review the files identified above`);
    console.log(`2. Share the ${colors.cyan}${outputFile}${colors.reset} file for detailed analysis`);
    console.log(`3. We'll create specific fixes for your exact implementation\n`);
}

// Run the analysis
runAnalysis();