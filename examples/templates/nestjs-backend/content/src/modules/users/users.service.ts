import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';

// This is a mock implementation for demonstration
// In a real application, you would use TypeORM entities and repositories
interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
    updatedAt: string;
}

@Injectable()
export class UsersService {
    private users: User[] = [
        {
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: 'admin@example.com',
            name: 'Admin User',
            role: 'admin',
            createdAt: '2023-12-01T10:00:00.000Z',
            updatedAt: '2023-12-01T10:00:00.000Z',
        },
        {
            id: '987fcdeb-51a2-43d1-9c48-b123456789ab',
            email: 'user@example.com',
            name: 'Regular User',
            role: 'user',
            createdAt: '2023-12-01T11:00:00.000Z',
            updatedAt: '2023-12-01T11:00:00.000Z',
        },
    ];

    async findAll(params: {
        page: number;
        limit: number;
        search?: string;
    }): Promise<PaginatedUsersResponseDto> {
        const { page, limit, search } = params;
        let filteredUsers = [...this.users];

        // Apply search filter if provided
        if (search) {
            const searchLower = search.toLowerCase();
            filteredUsers = filteredUsers.filter(
                user =>
                    user.name.toLowerCase().includes(searchLower) ||
                    user.email.toLowerCase().includes(searchLower)
            );
        }

        // Calculate pagination
        const total = filteredUsers.length;
        const totalPages = Math.ceil(total / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

        return {
            data: paginatedUsers.map(user => this.toUserResponse(user)),
            meta: {
                page,
                limit,
                total,
                totalPages,
            },
        };
    }

    async findOne(id: string): Promise<UserResponseDto> {
        const user = this.users.find(u => u.id === id);
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }
        return this.toUserResponse(user);
    }

    async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
        // Check if user with email already exists
        const existingUser = this.users.find(u => u.email === createUserDto.email);
        if (existingUser) {
            throw new ConflictException(`User with email ${createUserDto.email} already exists`);
        }

        const newUser: User = {
            id: this.generateUuid(),
            email: createUserDto.email,
            name: createUserDto.name,
            role: createUserDto.role,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        this.users.push(newUser);
        return this.toUserResponse(newUser);
    }

    async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
        const userIndex = this.users.findIndex(u => u.id === id);
        if (userIndex === -1) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        // Check for email conflicts if email is being updated
        if (updateUserDto.email) {
            const existingUser = this.users.find(
                u => u.email === updateUserDto.email && u.id !== id
            );
            if (existingUser) {
                throw new ConflictException(`User with email ${updateUserDto.email} already exists`);
            }
        }

        // Update user
        const updatedUser = {
            ...this.users[userIndex],
            ...updateUserDto,
            updatedAt: new Date().toISOString(),
        };

        this.users[userIndex] = updatedUser;
        return this.toUserResponse(updatedUser);
    }

    async remove(id: string): Promise<void> {
        const userIndex = this.users.findIndex(u => u.id === id);
        if (userIndex === -1) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        this.users.splice(userIndex, 1);
    }

    private toUserResponse(user: User): UserResponseDto {
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }

    private generateUuid(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}
