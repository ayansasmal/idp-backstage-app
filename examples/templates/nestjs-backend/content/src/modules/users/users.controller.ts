import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
    ApiBearerAuth
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';

@ApiTags('Users')
@Controller('users')
{% if values.enableAuth %} @ApiBearerAuth('JWT-auth')
{% endif %} export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @ApiOperation({
        summary: 'List all users',
        description: 'Retrieve a paginated list of all users with optional search filtering'
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'Page number for pagination',
        example: 1
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Number of items per page',
        example: 10
    })
    @ApiQuery({
        name: 'search',
        required: false,
        type: String,
        description: 'Search term for filtering users',
        example: 'john'
    })
    @ApiResponse({
        status: 200,
        description: 'Users retrieved successfully',
        type: PaginatedUsersResponseDto
    })
    @ApiResponse({
        status: 400,
        description: 'Bad request - Invalid query parameters'
    })
    async findAll(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('search') search?: string,
    ): Promise<PaginatedUsersResponseDto> {
        return this.usersService.findAll({ page, limit, search });
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Get user by ID',
        description: 'Retrieve a specific user by their unique identifier'
    })
    @ApiParam({
        name: 'id',
        description: 'User unique identifier',
        example: '123e4567-e89b-12d3-a456-426614174000'
    })
    @ApiResponse({
        status: 200,
        description: 'User found',
        type: UserResponseDto
    })
    @ApiResponse({
        status: 404,
        description: 'User not found'
    })
    async findOne(@Param('id') id: string): Promise<UserResponseDto> {
        return this.usersService.findOne(id);
    }

    @Post()
    @ApiOperation({
        summary: 'Create a new user',
        description: 'Create a new user in the system with the provided information'
    })
    @ApiResponse({
        status: 201,
        description: 'User created successfully',
        type: UserResponseDto
    })
    @ApiResponse({
        status: 400,
        description: 'Bad request - Invalid input data'
    })
    @ApiResponse({
        status: 409,
        description: 'Conflict - User with email already exists'
    })
    async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
        return this.usersService.create(createUserDto);
    }

    @Put(':id')
    @ApiOperation({
        summary: 'Update user',
        description: 'Update an existing user\'s information'
    })
    @ApiParam({
        name: 'id',
        description: 'User unique identifier'
    })
    @ApiResponse({
        status: 200,
        description: 'User updated successfully',
        type: UserResponseDto
    })
    @ApiResponse({
        status: 400,
        description: 'Bad request - Invalid input data'
    })
    @ApiResponse({
        status: 404,
        description: 'User not found'
    })
    async update(
        @Param('id') id: string,
        @Body() updateUserDto: UpdateUserDto,
    ): Promise<UserResponseDto> {
        return this.usersService.update(id, updateUserDto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Delete user',
        description: 'Delete a user from the system'
    })
    @ApiParam({
        name: 'id',
        description: 'User unique identifier'
    })
    @ApiResponse({
        status: 204,
        description: 'User deleted successfully'
    })
    @ApiResponse({
        status: 404,
        description: 'User not found'
    })
    async remove(@Param('id') id: string): Promise<void> {
        return this.usersService.remove(id);
    }
}
