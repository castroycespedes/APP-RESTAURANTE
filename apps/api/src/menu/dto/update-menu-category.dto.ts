import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateMenuCategoryDto {
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
