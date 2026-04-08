import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateDiagnosticRequestDto } from './dto/create-diagnostic-request.dto';
import { DiagnosticsService } from './diagnostics.service';

@ApiTags('diagnostics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DiagnosticsController {
  public constructor(private readonly diagnosticsService: DiagnosticsService) {}

  @Post('diagnostic-requests')
  @ApiOperation({ summary: 'Create a new asynchronous diagnostic request.' })
  public createRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDiagnosticRequestDto,
  ) {
    return this.diagnosticsService.createRequest(user, dto);
  }

  @Get('diagnostic-requests')
  @ApiOperation({ summary: 'List diagnostic requests visible to the current user.' })
  public listRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.diagnosticsService.listRequests(user);
  }

  @Get('diagnostic-requests/:requestId')
  @ApiOperation({ summary: 'Get the full detail for a diagnostic request.' })
  public getRequestDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
  ) {
    return this.diagnosticsService.getRequestDetail(user, requestId);
  }

  @Get('diagnostic-runs/:runId')
  @ApiOperation({ summary: 'Get the detail for one diagnostic run.' })
  public getRunDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('runId') runId: string,
  ) {
    return this.diagnosticsService.getRunDetail(user, runId);
  }
}
