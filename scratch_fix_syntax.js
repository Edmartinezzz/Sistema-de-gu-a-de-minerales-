const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'public/js/app.js');
let content = fs.readFileSync(p, 'utf8');

// The error was specifically: 700;">?x ` VER MÁS</div>
// We need to remove the ?x and the backtick.
// Since the '' character is unpredictable, we use a regex or a simple replacement for the suspicious pattern.

const fixedContent = content.replace(/700;">.*?` VER MÁS<\/div>/g, '700;">VER MÁS</div>')
                            .replace(/<div class="stat-icon">.*?<\/div>/g, (match) => {
                                if (match.includes('Ingresos')) return '<div class="stat-icon">💰</div>';
                                return match;
                            })
                            // Let's also fix the specific mangled icons I saw
                            .replace(/<div style="font-size: 24px;">.*?<\/div>/g, '<div style="font-size: 24px;">📈</div>');

fs.writeFileSync(p, fixedContent, 'utf8');
console.log('Fixed syntax errors in app.js!');
