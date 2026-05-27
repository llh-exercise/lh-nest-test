import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateTypesDto } from './dto/create-types.dto';
import { UpdateTypesDto } from './dto/update-types.dto';
import { TypesService, type TypesRecord } from './types.service';

@ApiTags('分类')
@Controller('types')
export class TypesController {
  constructor(private readonly typesService: TypesService) {}

  @Post()
  @ApiOperation({ summary: '新增分类' })
  create(@Body() body: CreateTypesDto): Promise<TypesRecord> {
    return this.typesService.create(body.data);
  }

  @Get()
  @ApiOperation({ summary: '获取分类列表' })
  findAll(): Promise<TypesRecord[]> {
    return this.typesService.findAll();
  }

  @Put(':id')
  @ApiOperation({ summary: '更新分类' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateTypesDto,
  ): Promise<TypesRecord> {
    return this.typesService.update(id, body.data);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除分类' })
  remove(@Param('id') id: string): Promise<void> {
    return this.typesService.remove(id);
  }
}
