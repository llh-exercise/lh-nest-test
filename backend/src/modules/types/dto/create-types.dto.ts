import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';

export class CreateTypesDataDto {
  @ApiPropertyOptional({ description: '父级标识，为空表示顶级分类' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentId?: string | null;

  @ApiProperty({ description: '关联版本标识（逻辑外键）' })
  @IsString()
  @IsNotEmpty({ message: '版本标识不能为空' })
  @MaxLength(50)
  versionId!: string;

  @ApiProperty({ description: '编码' })
  @IsString()
  @IsNotEmpty({ message: '编码不能为空' })
  @MaxLength(50)
  code!: string;

  @ApiProperty({ description: '名称' })
  @IsString()
  @IsNotEmpty({ message: '名称不能为空' })
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ description: '备注', default: '' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ description: '排序序号' })
  @IsOptional()
  @IsInt()
  @Min(0)
  index?: number;

  @ApiPropertyOptional({ description: '状态：0 废弃，1 启用', default: 1 })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能是 0 或 1' })
  status?: number;
}

export class CreateTypesDto {
  @ApiProperty({ type: CreateTypesDataDto })
  @ValidateNested()
  @Type(() => CreateTypesDataDto)
  data!: CreateTypesDataDto;
}
