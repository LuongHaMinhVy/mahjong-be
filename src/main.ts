import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { type ValidationError } from 'class-validator';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './shared/exceptions/index.js';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor.js';
import { I18nService } from './shared/i18n/i18n.service.js';

function getValidationArgs(
  constraint: string,
  defaultMessage: string,
): Record<string, any> | undefined {
  if (constraint === 'minLength' || constraint === 'maxLength') {
    const match = defaultMessage.match(/\d+/);
    if (match) {
      return { min: match[0], max: match[0] };
    }
  }
  return undefined;
}

function formatErrors(
  errors: ValidationError[],
  i18nService: I18nService,
): string[] {
  const messages: string[] = [];

  const flatten = (errs: ValidationError[]) => {
    for (const error of errs) {
      if (error.constraints) {
        for (const [constraintKey, defaultMessage] of Object.entries(
          error.constraints,
        )) {
          const translationKey = `validation.${constraintKey}`;
          const args = getValidationArgs(constraintKey, defaultMessage);

          let translated = i18nService.translate(translationKey, args);
          if (translated === translationKey) {
            translated = defaultMessage;
          }
          messages.push(translated);
        }
      }
      if (error.children && error.children.length > 0) {
        flatten(error.children);
      }
    }
  };

  flatten(errors);
  return messages;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const i18nService = app.get(I18nService);

  // CORS
  app.enableCors();

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const messages = formatErrors(errors, i18nService);
        return new BadRequestException(messages);
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter(i18nService));

  // Global response interceptor
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Mahjong Game API')
    .setDescription('Backend API for Mahjong Online Game')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
