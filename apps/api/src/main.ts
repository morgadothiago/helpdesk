import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

/**
 * `JWT_SECRET` é obrigatório (SPEC-02, seção 7): a aplicação falha
 * explicitamente na inicialização se ele estiver ausente, em vez de subir
 * com um segredo implícito/inseguro.
 */
function assertRequiredEnv(): void {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET não configurado. Defina a variável de ambiente JWT_SECRET antes de iniciar a aplicação.',
    );
  }
}

async function bootstrap() {
  assertRequiredEnv();

  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3001',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Helpdesk API')
    .setDescription('Documentação da API do Helpdesk')
    .setVersion('0.0.1')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
void bootstrap();
