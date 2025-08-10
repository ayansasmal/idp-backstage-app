const jsonServer = require('json-server');
const fs = require('fs');
const path = require('path');

const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

// Use default middlewares (logger, static, cors and no-cache)
server.use(middlewares);

// Custom route to serve organizations as YAML format
server.get('/organizations.yaml', (req, res) => {
  try {
    const dbPath = path.join(__dirname, 'db.json');
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    // Convert JSON to YAML-like string
    let yamlContent = '';
    data.organizations.forEach((entity, index) => {
      if (index > 0) yamlContent += '\n---\n';
      yamlContent += `apiVersion: ${entity.apiVersion}\n`;
      yamlContent += `kind: ${entity.kind}\n`;
      yamlContent += `metadata:\n`;
      yamlContent += `  name: ${entity.metadata.name}\n`;

      if (entity.metadata.annotations) {
        yamlContent += `  annotations:\n`;
        Object.entries(entity.metadata.annotations).forEach(([key, value]) => {
          yamlContent += `    ${key}: ${value}\n`;
        });
      }

      yamlContent += `spec:\n`;
      Object.entries(entity.spec).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          yamlContent += `  ${key}: [${value.join(', ')}]\n`;
        } else if (typeof value === 'object') {
          yamlContent += `  ${key}:\n`;
          Object.entries(value).forEach(([subKey, subValue]) => {
            yamlContent += `    ${subKey}: ${subValue}\n`;
          });
        } else {
          yamlContent += `  ${key}: ${value}\n`;
        }
      });
    });

    res.setHeader('Content-Type', 'text/yaml');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(yamlContent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate YAML' });
  }
});

// Custom route to serve organizations as JSON (default JSON server behavior)
server.use('/api', router);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`JSON Server is running on port ${PORT}`);
  console.log(
    `Organization YAML endpoint: http://localhost:${PORT}/organizations.yaml`,
  );
  console.log(
    `Organization JSON endpoint: http://localhost:${PORT}/organizations`,
  );
});
