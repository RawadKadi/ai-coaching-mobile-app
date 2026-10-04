const fs = require('fs');
const path = './app/(coach)/settings/branding.tsx';
let content = fs.readFileSync(path, 'utf8');

const parts = content.split('const styles = StyleSheet.create({');

if (parts.length > 1) {
  let styleSheet = parts[1];
  
  styleSheet = styleSheet.replace(/backgroundColor: currentTheme\.colors\.background/g, "backgroundColor: '#020617'");
  styleSheet = styleSheet.replace(/backgroundColor: currentTheme\.colors\.surface/g, "backgroundColor: '#0F172A'");
  styleSheet = styleSheet.replace(/backgroundColor: currentTheme\.colors\.inputBackground/g, "backgroundColor: '#1E293B'");
  styleSheet = styleSheet.replace(/borderColor: currentTheme\.colors\.border/g, "borderColor: '#1E293B'");
  styleSheet = styleSheet.replace(/color: currentTheme\.colors\.text/g, "color: '#FFFFFF'");
  styleSheet = styleSheet.replace(/color: currentTheme\.colors\.textSecondary/g, "color: '#94A3B8'");
  
  content = parts[0] + 'const styles = StyleSheet.create({' + styleSheet;
  fs.writeFileSync(path, content);
  console.log('Fixed StyleSheet');
} else {
  console.log('StyleSheet not found');
}
