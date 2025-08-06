import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

async function generateSwagger() {
    const app = await NestFactory.create(AppModule);

    const config = new DocumentBuilder()
        .setTitle('${{ values.name }} API')
        .setDescription('${{ values.description }}')
        .setVersion('1.0.0')
        .addServer('http://localhost:${{ values.port }}/${{ values.apiPrefix }}', 'Development server')
        .addServer('https://staging-api.yourcompany.com/${{ values.apiPrefix }}', 'Staging server')
        .addServer('https://api.yourcompany.com/${{ values.apiPrefix }}', 'Production server'){% if values.enableAuth %}
    .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                name: 'JWT',
                description: 'Enter JWT token',
                in: 'header',
            },
            'JWT-auth',
        ){% endif %}
    .addTag('Health', 'Service health and monitoring endpoints')
    .addTag('Users', 'User management operations'){% if values.enableAuth %}
    .addTag('Authentication', 'Authentication and authorization endpoints'){% endif %}
    .build();

const document = SwaggerModule.createDocument(app, config);

// Write JSON version
fs.writeFileSync('./openapi.json', JSON.stringify(document, null, 2));

// Write YAML version
fs.writeFileSync('./openapi.yaml', yaml.dump(document, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
}));

console.log('✅ OpenAPI specification generated successfully!');
console.log('📄 Files created:');
console.log('  - openapi.json');
console.log('  - openapi.yaml');

await app.close();
}

generateSwagger().catch(console.error);
