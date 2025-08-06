import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class PaginationMetaDto {
    @ApiProperty({
        description: 'Current page number',
        example: 1,
        minimum: 1
    })
    page: number;

    @ApiProperty({
        description: 'Number of items per page',
        example: 10,
        minimum: 1
    })
    limit: number;

    @ApiProperty({
        description: 'Total number of items',
        example: 50,
        minimum: 0
    })
    total: number;

    @ApiProperty({
        description: 'Total number of pages',
        example: 5,
        minimum: 0
    })
    totalPages: number;
}

export class PaginatedUsersResponseDto {
    @ApiProperty({
        description: 'Array of users',
        type: [UserResponseDto]
    })
    data: UserResponseDto[];

    @ApiProperty({
        description: 'Pagination metadata',
        type: PaginationMetaDto
    })
    meta: PaginationMetaDto;
}
