import { Controller, Get, Post, Put, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('profile')
  getProfile(@Request() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Put('profile')
  updateProfile(@Request() req: any, @Body() data: { megaEmail?: string; megaPassword?: string }) {
    return this.usersService.updateProfile(req.user.id, data);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() data: { email: string; password?: string; role: Role; name?: string; note?: string; expiresAt?: Date | null }) {
    return this.usersService.create(data);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() data: { name?: string; note?: string; expiresAt?: Date | null }) {
    return this.usersService.update(id, data);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
