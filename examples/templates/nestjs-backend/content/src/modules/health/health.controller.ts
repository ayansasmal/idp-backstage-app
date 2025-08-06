import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    @Get()
    @ApiOperation({
        summary: 'Health check',
        description: 'Returns the health status of the service'
    })
    @ApiResponse({
        status: 200,
        description: 'Service is healthy',
        type: HealthResponseDto
    })
    check(): HealthResponseDto {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: '${{ values.name }}',
            version: process.env.npm_package_version || '1.0.0',
        };
    }

    @Get('ready')
    @ApiOperation({
        summary: 'Readiness check',
        description: 'Returns readiness status for Kubernetes probes'
    })
    @ApiResponse({
        status: 200,
        description: 'Service is ready',
        type: HealthResponseDto
    })
    ready(): HealthResponseDto {
        return {
            status: 'ready',
            timestamp: new Date().toISOString(),
            service: '${{ values.name }}',
            version: process.env.npm_package_version || '1.0.0',
        };
    }
}
