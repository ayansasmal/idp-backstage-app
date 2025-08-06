# ${{ values.name }}

${{ values.description }}

This is a NestJS backend service with comprehensive OpenAPI/Swagger documentation, created from the IDP platform template.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn{% if values.enableDatabase %}
- PostgreSQL database{% endif %}

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev
```

The service will be available at `http://localhost:${{ values.port }}`

### API Documentation

OpenAPI/Swagger documentation is automatically generated and available at:
- **Swagger UI**: `http://localhost:${{ values.port }}/docs`
- **OpenAPI JSON**: `http://localhost:${{ values.port }}/docs-json`

## 🏗️ Architecture

### Project Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts          # Root application module
├── modules/               # Feature modules
│   ├── users/            # Example users module
│   │   ├── dto/          # Data Transfer Objects
│   │   ├── entities/     # Database entities
│   │   ├── controllers/  # REST controllers
│   │   └── services/     # Business logic
├── common/               # Shared utilities
│   ├── decorators/       # Custom decorators
│   ├── filters/          # Exception filters
│   ├── guards/           # Authentication/authorization guards
│   ├── interceptors/     # Request/response interceptors
│   └── pipes/            # Validation pipes
├── config/               # Configuration files
└── swagger/              # OpenAPI configuration
```

### Key Features

- 🔍 **Comprehensive API Documentation**: Every endpoint documented with OpenAPI/Swagger
- 🛡️ **Type Safety**: Full TypeScript support with strict typing
- 🔒 **Security**: {% if values.enableAuth %}AWS Cognito authentication{% else %}Security middleware ready{% endif %}
- 📊 **Validation**: Request/response validation with class-validator
- 🗄️ **Database**: {% if values.enableDatabase %}PostgreSQL with TypeORM{% else %}Database-ready architecture{% endif %}
- 🧪 **Testing**: Unit and E2E tests with Jest
- 📈 **Monitoring**: Health checks and observability

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Application
PORT=${{ values.port }}
NODE_ENV=development
API_PREFIX=${{ values.apiPrefix }}

{% if values.enableDatabase %}# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=${{ values.name | replace('-', '_') }}_db

{% endif %}{% if values.enableAuth %}# Authentication
AWS_REGION=us-east-1
AWS_COGNITO_USER_POOL_ID=your_user_pool_id
AWS_COGNITO_CLIENT_ID=your_client_id
JWT_SECRET=your_jwt_secret

{% endif %}# Swagger
SWAGGER_TITLE=${{ values.name }} API
SWAGGER_DESCRIPTION=${{ values.description }}
SWAGGER_VERSION=1.0.0
```

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run E2E tests
npm run test:e2e
```

## 📚 API Documentation Standards

All API endpoints **MUST** include:

### 1. Operation Documentation
```typescript
@ApiOperation({ 
  summary: 'Get user by ID',
  description: 'Retrieves a specific user by their unique identifier'
})
```

### 2. Parameter Documentation
```typescript
@ApiParam({ 
  name: 'id', 
  description: 'User unique identifier',
  type: 'string',
  example: '123e4567-e89b-12d3-a456-426614174000'
})
```

### 3. Response Documentation
```typescript
@ApiResponse({ 
  status: 200, 
  description: 'User found successfully', 
  type: UserResponseDto 
})
@ApiResponse({ 
  status: 404, 
  description: 'User not found' 
})
```

### 4. DTO Validation
```typescript
export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com'
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe'
  })
  @IsString()
  @MinLength(2)
  name: string;
}
```

## 🚀 Deployment

### Docker

```bash
# Build the image
docker build -t ${{ values.name }} .

# Run the container
docker run -p ${{ values.port }}:${{ values.port }} ${{ values.name }}
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm run start:prod
```

## 📊 Health Checks

The service includes health check endpoints:

- `GET /${{ values.apiPrefix }}/health` - Basic health check
- `GET /${{ values.apiPrefix }}/health/ready` - Readiness probe{% if values.enableDatabase %}
- `GET /${{ values.apiPrefix }}/health/db` - Database connectivity{% endif %}

## 🔗 Links

- [Backstage Component](${{ 'https://your-backstage-url.com/catalog/default/component/' + values.name }})
- [API Documentation](${{ 'http://localhost:' + values.port + '/docs' }})
- [Repository](${{ values.repoUrl }})

## 👥 Ownership

**Owner:** ${{ values.owner }}

For questions or support, please contact the component owner or the platform team.

---

Generated with ❤️ by IDP Platform
