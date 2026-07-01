import { Request, Response } from 'express';
import { poolPromise, sql } from '../config/database';

interface Holiday {
    date: string;
    name: string;
}

export async function getCalendar(req: Request, res: Response) {
    try {
        const pool = await poolPromise;
        const username = req.user?.username;
        const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year as string) || new Date().getFullYear();

        // Buscar dias de login
        const loginQuery = `
            SELECT DAY(Data) as day
            FROM LogAcesso
            WHERE Username = @username
              AND Action = 'Login'
              AND Status = 'Positivo'
              AND MONTH(Data) = @month
              AND YEAR(Data) = @year
        `;
        
        const loginRequest = pool.request();
        loginRequest.input('username', sql.NVarChar, username);
        loginRequest.input('month', sql.Int, month);
        loginRequest.input('year', sql.Int, year);
        
        const loginResult = await loginRequest.query(loginQuery);
        const loginDays = loginResult.recordset.map(r => r.day);

        // Gerar feriados
        const holidays = getHolidays(year);

        // Dias da semana em português
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

        // Primeiro dia do mês
        const firstDay = new Date(year, month - 1, 1);
        const firstDayOfWeek = firstDay.getDay(); // 0 = Domingo

        // Último dia do mês
        const lastDay = new Date(year, month, 0);
        const daysInMonth = lastDay.getDate();

        // Gerar HTML do calendário
        let html = '<div class="calendar-weekdays">';
        for (const day of dayNames) {
            html += `<div class="calendar-weekday">${day}</div>`;
        }
        html += '</div>';

        html += '<div class="calendar-days">';

        // Dias vazios no início
        for (let i = 0; i < firstDayOfWeek; i++) {
            html += '<div class="calendar-day empty"></div>';
        }

        // Dias do mês
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month - 1, day);
            const dayOfWeek = currentDate.getDay();
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;
            
            const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const holiday = holidays.find(h => h.date === dateStr);
            const hasLogin = loginDays.includes(day);

            let dayClass = 'calendar-day';
            if (isSunday) dayClass += ' sunday';
            if (isSaturday) dayClass += ' saturday';
            if (holiday) dayClass += ' holiday';
            if (hasLogin) dayClass += ' has-login';

            html += `<div class="${dayClass}">`;
            html += `<span class="day-number">${day}</span>`;

            if (holiday) {
                html += `<i class="fas fa-rocket holiday-icon" title="${holiday.name}"></i>`;
            } else if (isSunday) {
                html += '<i class="fas fa-sun sunday-icon" title="Domingo"></i>';
            } else if (isSaturday) {
                html += '<i class="fas fa-moon saturday-icon" title="Sábado"></i>';
            } else if (hasLogin) {
                html += '<i class="fas fa-check success-icon" title="Login realizado"></i>';
            } else {
                html += '<i class="fas fa-times error-icon" title="Sem login"></i>';
            }

            html += '</div>';
        }

        html += '</div>';

        // Nome do mês
        const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];

        res.json({
            success: true,
            html,
            monthName: monthNames[month - 1],
            year,
            month
        });

    } catch (error) {
        console.error('Erro ao carregar calendário:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao carregar calendário' 
        });
    }
}

function getHolidays(year: number): Holiday[] {
    const holidays: Holiday[] = [
        { date: `${year}-01-01`, name: 'Ano Novo' },
        { date: `${year}-04-21`, name: 'Tiradentes' },
        { date: `${year}-05-01`, name: 'Dia do Trabalho' },
        { date: `${year}-09-07`, name: 'Independência' },
        { date: `${year}-10-12`, name: 'Nossa Senhora Aparecida' },
        { date: `${year}-11-02`, name: 'Finados' },
        { date: `${year}-11-15`, name: 'Proclamação da República' },
        { date: `${year}-11-20`, name: 'Consciência Negra' },
        { date: `${year}-12-25`, name: 'Natal' }
    ];

    // Calcular Páscoa e feriados móveis
    const pascoa = getEasterDate(year);
    
    const carnaval1 = new Date(pascoa);
    carnaval1.setDate(pascoa.getDate() - 48);
    holidays.push({ 
        date: formatDate(carnaval1), 
        name: 'Carnaval' 
    });

    const carnaval2 = new Date(pascoa);
    carnaval2.setDate(pascoa.getDate() - 47);
    holidays.push({ 
        date: formatDate(carnaval2), 
        name: 'Carnaval' 
    });

    const sextaSanta = new Date(pascoa);
    sextaSanta.setDate(pascoa.getDate() - 2);
    holidays.push({ 
        date: formatDate(sextaSanta), 
        name: 'Sexta-feira Santa' 
    });

    holidays.push({ 
        date: formatDate(pascoa), 
        name: 'Páscoa' 
    });

    const corpusChristi = new Date(pascoa);
    corpusChristi.setDate(pascoa.getDate() + 60);
    holidays.push({ 
        date: formatDate(corpusChristi), 
        name: 'Corpus Christi' 
    });

    return holidays;
}

function getEasterDate(year: number): Date {
    // Algoritmo de Gauss para calcular a Páscoa
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}