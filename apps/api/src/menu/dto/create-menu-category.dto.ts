import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateMenuCategoryDto {
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
