import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyReport, getReportHistory, generateMarkdownReport } from '@/lib/monitoring/report-generator';
import { validateInput } from '@/lib/security/input-validation';
import { z } from 'zod';

const querySchema = z.object({
  action: z.enum(['generate', 'history', 'latest']).optional(),
  format: z.enum(['json', 'markdown']).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  endDate: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryValidation = validateInput(
      {
        action: searchParams.get('action') || undefined,
        format: searchParams.get('format') || undefined,
        limit: searchParams.get('limit') || undefined,
        endDate: searchParams.get('endDate') || undefined,
      },
      querySchema
    );

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryValidation.errors },
        { status: 400 }
      );
    }

    const { action = 'latest', format = 'json', limit, endDate } = queryValidation.data;
    const limitNumber = limit ? parseInt(limit, 10) : undefined;

    switch (action) {
      case 'generate': {
        // Generate a new report
        const reportEndDate = endDate ? new Date(endDate) : new Date();
        if (isNaN(reportEndDate.getTime())) {
          return NextResponse.json(
            { error: 'Invalid endDate format' },
            { status: 400 }
          );
        }

        const report = await generateWeeklyReport(reportEndDate);

        if (format === 'markdown') {
          const markdown = generateMarkdownReport(report);
          return new NextResponse(markdown, {
            headers: {
              'Content-Type': 'text/markdown',
              'Content-Disposition': `attachment; filename="weekly-report-${report.id}.md"`,
            },
          });
        }

        return NextResponse.json(report);
      }

      case 'history': {
        // Get report history
        const reports = await getReportHistory(limitNumber || 12);
        
        if (format === 'markdown' && reports.length > 0) {
          // Combine multiple reports into one markdown document
          const markdowns = reports.map(report => generateMarkdownReport(report));
          const combined = markdowns.join('\n\n---\n\n');
          
          return new NextResponse(combined, {
            headers: {
              'Content-Type': 'text/markdown',
              'Content-Disposition': 'attachment; filename="report-history.md"',
            },
          });
        }

        return NextResponse.json({
          reports,
          count: reports.length,
        });
      }

      case 'latest':
      default: {
        // Get the most recent report
        const reports = await getReportHistory(1);
        
        if (reports.length === 0) {
          // No reports exist, generate one
          const report = await generateWeeklyReport();
          
          if (format === 'markdown') {
            const markdown = generateMarkdownReport(report);
            return new NextResponse(markdown, {
              headers: {
                'Content-Type': 'text/markdown',
                'Content-Disposition': `attachment; filename="weekly-report-${report.id}.md"`,
              },
            });
          }

          return NextResponse.json(report);
        }

        const latestReport = reports[0];
        
        if (format === 'markdown') {
          const markdown = generateMarkdownReport(latestReport);
          return new NextResponse(markdown, {
            headers: {
              'Content-Type': 'text/markdown',
              'Content-Disposition': `attachment; filename="weekly-report-${latestReport.id}.md"`,
            },
          });
        }

        return NextResponse.json(latestReport);
      }
    }
  } catch (error) {
    console.error('Error in monitoring reports API:', error);
    return NextResponse.json(
      { error: 'Failed to process report request' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const bodySchema = z.object({
      endDate: z.string().optional(),
    });

    const validation = validateInput(body, bodySchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.errors },
        { status: 400 }
      );
    }

    const { endDate } = validation.data;
    const reportEndDate = endDate ? new Date(endDate) : new Date();
    
    if (isNaN(reportEndDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid endDate format' },
        { status: 400 }
      );
    }

    const report = await generateWeeklyReport(reportEndDate);
    
    return NextResponse.json({
      success: true,
      report,
      message: `Weekly report generated for period ending ${reportEndDate.toISOString()}`,
    });
  } catch (error) {
    console.error('Error generating monitoring report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}