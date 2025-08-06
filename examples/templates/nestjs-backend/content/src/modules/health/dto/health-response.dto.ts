import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
    @ApiProperty({
        description: 'Health status of the service',
        example: 'ok',
        enum: ['ok', 'ready', 'error']
    })
    status: string;

    @ApiProperty({
        description: 'Timestamp of the health check',
        example: '2023-12-01T10:00:00.000Z'
    })
    timestamp: string;

    @ApiProperty({
        description: 'Service name',
        example: '${{ values.name }}'
    })
    service: string;

    @ApiProperty({
        description: 'Service version',
        example: '1.0.0'
    })
    version: string;
}
