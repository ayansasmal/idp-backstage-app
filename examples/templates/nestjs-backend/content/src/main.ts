import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Global prefix
    app.setGlobalPrefix('${{ values.apiPrefix }}');

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // CORS configuration
    app.enableCors({
        origin: process.env.CORS_ORIGIN || '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        allowedHeaders: 'Content-Type, Accept, Authorization',
    });

    // Swagger documentation setup
    const config = new DocumentBuilder()
        .setTitle(process.env.SWAGGER_TITLE || '${{ values.name }} API')
        .setDescription(process.env.SWAGGER_DESCRIPTION || '${{ values.description }}')
        .setVersion(process.env.SWAGGER_VERSION || '1.0.0'){% if values.enableAuth %}
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
    .addServer(`http://localhost:${{ values.port }}`, 'Development server')
    .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
        persistAuthorization: true,
    },
});

const port = process.env.PORT || ${{ values.port }};
await app.listen(port);

console.log(`🚀 Application is running on: http://localhost:${port}`);
console.log(`📚 Swagger documentation: http://localhost:${port}/docs`);
}

bootstrap();
