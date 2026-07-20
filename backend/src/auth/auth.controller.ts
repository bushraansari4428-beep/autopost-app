import { Controller, Post, Get, Body, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() req: any) {
    const user = await this.authService.validateUser(req.email, req.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Post('register')
  async register(@Body() req: any) {
    if (!req.email || !req.password) {
      throw new UnauthorizedException('Email and password required');
    }
    return this.authService.register(req.email, req.password);
  }


  @Post('forgot-password')
  async forgotPassword(@Body() req: any) {
    if (!req.email) {
      throw new UnauthorizedException('Email is required');
    }
    return this.authService.forgotPassword(req.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() req: any) {
    if (!req.token || !req.newPassword) {
      throw new UnauthorizedException('Token and new password are required');
    }
    return this.authService.resetPassword(req.token, req.newPassword);
  }
}
