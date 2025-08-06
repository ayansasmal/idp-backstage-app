import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
    @ApiProperty({
        description: 'User unique identifier',
        example: '123e4567-e89b-12d3-a456-426614174000'
    })
    id: string;

    @ApiProperty({
        description: 'User email address',
        example: 'john.doe@example.com'
    })
    email: string;

    @ApiProperty({
        description: 'User full name',
        example: 'John Doe'
    })
    name: string;

    @ApiProperty({
        description: 'User role in the system',
        example: 'user',
        enum: ['admin', 'user', 'guest']
    })
    role: string;

    @ApiProperty({
        description: 'User creation timestamp',
        example: '2023-12-01T10:00:00.000Z'
    })
    createdAt: string;

    @ApiProperty({
        description: 'User last update timestamp',
        example: '2023-12-01T15:30:00.000Z'
    })
    updatedAt: string;
}
