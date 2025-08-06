import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
    @ApiProperty({
        description: 'User email address',
        example: 'john.doe@example.com',
        format: 'email'
    })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @IsNotEmpty({ message: 'Email is required' })
    email: string;

    @ApiProperty({
        description: 'User full name',
        example: 'John Doe',
        minLength: 2
    })
    @IsString({ message: 'Name must be a string' })
    @IsNotEmpty({ message: 'Name is required' })
    @MinLength(2, { message: 'Name must be at least 2 characters long' })
    name: string;

    @ApiProperty({
        description: 'User role in the system',
        example: 'user',
        enum: ['admin', 'user', 'guest'],
        default: 'user'
    })
    @IsString({ message: 'Role must be a string' })
    @IsNotEmpty({ message: 'Role is required' })
    role: string = 'user';
}
