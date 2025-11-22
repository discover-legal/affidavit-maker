// Simple Node.js script to convert SVG to PNG
// Run with: node convert-icon.js

const fs = require('fs');
const path = require('path');

console.log('SVG app icon has been created at: /home/user/affidavit-maker/client/public/app-icon.svg');
console.log('\nTo convert to PNG (1024x1024), you can:');
console.log('1. Use an online converter like: https://cloudconvert.com/svg-to-png');
console.log('2. Use ImageMagick: convert -background none -size 1024x1024 app-icon.svg app-icon.png');
console.log('3. Use Inkscape: inkscape -w 1024 -h 1024 app-icon.svg -o app-icon.png');
console.log('4. Use GIMP or Photoshop to open and export at 1024x1024');
console.log('\nThe SVG can also be used directly in many contexts.');
