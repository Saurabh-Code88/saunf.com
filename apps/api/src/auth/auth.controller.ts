import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateStaffDto, LoginStaffDto, UpdatePasswordDto } from './dto/staff.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: CreateStaffDto) {
    const staff = await this.authService.createStaff(dto);
    return {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
    };
  }

  @Post('login')
  async login(@Body() dto: LoginStaffDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    const staff = await this.authService.getStaffById(req.user.sub);
    return {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      status: staff.status,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Request() req: any,
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.authService.updatePassword(req.user.sub, dto);
  }
}
