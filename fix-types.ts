import fs from 'fs';
import path from 'path';

const files = [
  'lib/state.ts',
  'lib/tools/whatsapp.ts',
  'lib/tools/personal-assistant.ts',
  'lib/tools/customer-support.ts',
  'lib/tools/navigation-system.ts'
];

files.forEach(file => {
  const p = path.join(process.cwd(), file);
  let content = fs.readFileSync(p, 'utf8');
  content = content.replace(/type: 'OBJECT'/g, "type: 'object'");
  content = content.replace(/type: 'STRING'/g, "type: 'string'");
  content = content.replace(/type: 'NUMBER'/g, "type: 'number'");
  content = content.replace(/type: 'INTEGER'/g, "type: 'integer'");
  content = content.replace(/type: 'ARRAY'/g, "type: 'array'");

  content = content.replace(/type: "OBJECT"/g, 'type: "object"');
  content = content.replace(/type: "STRING"/g, 'type: "string"');
  content = content.replace(/type: "NUMBER"/g, 'type: "number"');
  content = content.replace(/type: "INTEGER"/g, 'type: "integer"');
  content = content.replace(/type: "ARRAY"/g, 'type: "array"');
  
  fs.writeFileSync(p, content);
  console.log('Fixed', file);
});
