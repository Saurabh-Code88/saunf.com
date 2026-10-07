import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Staff } from '../entities/staff.entity';
import { CreateStaffDto, LoginStaffDto, UpdatePasswordDto } from './dto/staff.dto';

export interface AuthPayload {
  sub: string; // staff ID
  email: string;
  role: string;
}

export interface AuthResponse {
  access_token: string;
  staff: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    private readonly jwtService: JwtService,
  ) {}

  async createStaff(dto: CreateStaffDto): Promise<Staff> {
    const existing = await this.staffRepository.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException(
        `Staff with email ${dto.email} already exists`,
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const staff = this.staffRepository.create({
      email: dto.email.toLowerCase(),
      passwordHash: hashedPassword,
      name: dto.name,
      role: dto.role,
      status: 'active',
    });

    return this.staffRepository.save(staff);
  }

  async login(dto: LoginStaffDto): Promise<AuthResponse> {
    const staff = await this.staffRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (!staff) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (staff.status !== 'active') {
      throw new UnauthorizedException(
        `Staff account is ${staff.status}. Contact administrator.`,
      );
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      staff.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login
    staff.lastLoginAt = new Date();
    await this.staffRepository.save(staff);

    const payload: AuthPayload = {
      sub: staff.id,
      email: staff.email,
      role: staff.role,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      staff: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
      },
    };
  }

  async validateToken(token: string): Promise<AuthPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async getStaffById(id: string): Promise<Staff> {
    const staff = await this.staffRepository.findOne({ where: { id } });

    if (!staff) {
      throw new NotFoundException(`Staff with id ${id} not found`);
    }

    return staff;
  }

  async updatePassword(
    staffId: string,
    dto: UpdatePasswordDto,
  ): Promise<{ message: string }> {
    const staff = await this.getStaffById(staffId);

    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      staff.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHashedPassword = await bcrypt.hash(dto.newPassword, 10);
    staff.passwordHash = newHashedPassword;
    await this.staffRepository.save(staff);

    return { message: 'Password updated successfully' };
  }

  async deactivateStaff(staffId: string): Promise<Staff> {
    const staff = await this.getStaffById(staffId);
    staff.status = 'inactive';
    return this.staffRepository.save(staff);
  }

  async reactivateStaff(staffId: string): Promise<Staff> {
    const staff = await this.getStaffById(staffId);
    staff.status = 'active';
    return this.staffRepository.save(staff);
  }
}
