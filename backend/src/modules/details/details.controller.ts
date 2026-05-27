import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { type DetailsRecord, DetailsService } from './details.service';
import { CreateDetailsDto } from './dto/create-details.dto';
import { QueryDetailsDto } from './dto/query-details.dto';
import { UpdateDetailsDto } from './dto/update-details.dto';

@ApiTags('明细')
@Controller('details')
export class DetailsController {
  constructor(private readonly detailsService: DetailsService) {}

  @Post()
  @ApiOperation({ summary: '新增明细' })
  create(@Body() body: CreateDetailsDto): Promise<DetailsRecord> {
    return this.detailsService.create(body.data);
  }

  @Get()
  @ApiOperation({ summary: '获取明细列表' })
  findAll(@Query() query: QueryDetailsDto): Promise<DetailsRecord[]> {
    return this.detailsService.findAll(query.typeId);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新明细' })
  update(@Param('id') id: string, @Body() body: UpdateDetailsDto): Promise<DetailsRecord> {
    return this.detailsService.update(id, body.data);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除明细' })
  remove(@Param('id') id: string): Promise<void> {
    return this.detailsService.remove(id);
  }
}
