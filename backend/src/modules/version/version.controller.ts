import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateVersionDto } from './dto/create-version.dto';
import { UpdateVersionDto } from './dto/update-version.dto';
import { type VersionRecord, VersionService } from './version.service';

@ApiTags('版本')
@Controller('version')
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Post()
  @ApiOperation({ summary: '新增版本' })
  create(@Body() body: CreateVersionDto): Promise<VersionRecord> {
    return this.versionService.create(body.data);
  }

  @Get()
  @ApiOperation({ summary: '获取版本列表' })
  findAll(): Promise<VersionRecord[]> {
    return this.versionService.findAll();
  }

  @Put(':id')
  @ApiOperation({ summary: '更新版本' })
  update(@Param('id') id: string, @Body() body: UpdateVersionDto): Promise<VersionRecord> {
    return this.versionService.update(id, body.data);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除版本' })
  remove(@Param('id') id: string): Promise<void> {
    return this.versionService.remove(id);
  }
}
