import { IsInt, Min } from 'class-validator';

export class MoveTableDto {
  @IsInt()
  @Min(0)
  posX!: number;

  @IsInt()
  @Min(0)
  posY!: number;
}
