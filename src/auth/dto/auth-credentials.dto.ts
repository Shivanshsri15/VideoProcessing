import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** Shared body for register and login (email + password). */
export class AuthCredentialsDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
