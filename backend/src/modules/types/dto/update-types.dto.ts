import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class UpdateTypesDataDto {
  @ApiPropertyOptional({ description: '父级标识，为空表示顶级分类' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentId?: string | null;

  @ApiPropertyOptional({ description: '编码' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ description: '名称' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ description: '排序序号' })
  @IsOptional()
  @IsInt()
  @Min(0)
  index?: number;

  @ApiPropertyOptional({ description: '状态：0 废弃，1 启用' })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能是 0 或 1' })
  status?: number;
}

export class UpdateTypesDto {
  @ApiProperty({ type: UpdateTypesDataDto })
  @ValidateNested()
  @Type(() => UpdateTypesDataDto)
  data!: UpdateTypesDataDto;
}
