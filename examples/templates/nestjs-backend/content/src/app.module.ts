import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; {% if values.enableDatabase %}
import { TypeOrmModule } from '@nestjs/typeorm'; {% endif %}
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module'; {% if values.enableAuth %}
import { AuthModule } from './modules/auth/auth.module'; {% endif %}

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }), {% if values.enableDatabase %}
    TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DATABASE_HOST || 'localhost',
            port: parseInt(process.env.DATABASE_PORT) || 5432,
            username: process.env.DATABASE_USERNAME || 'postgres',
            password: process.env.DATABASE_PASSWORD || 'password',
            database: process.env.DATABASE_NAME || '${{ values.name | replace(' - ', '_') }}_db',
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: process.env.NODE_ENV === 'development',
            logging: process.env.NODE_ENV === 'development',
        }), {% endif %}
    HealthModule,
    UsersModule, {% if values.enableAuth %}
AuthModule, {% endif %}
  ],
})
export class AppModule { }
