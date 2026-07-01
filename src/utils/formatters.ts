export function formatName(username: string): string {
    if (!username) return 'Usuário';
    
    const parts = username.split('.');
    const nome = parts[0] ? 
        parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase() : '';
    const sobrenome = parts.length > 1 ? 
        parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase() : '';
    
    return `${nome} ${sobrenome}`.trim();
}

export function formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(months / 12);

    if (years > 0) return `${years} ano${years > 1 ? 's' : ''} atrás`;
    if (months > 0) return `${months} mês${months > 1 ? 'es' : ''} atrás`;
    if (days > 0) {
        if (days === 1) return 'Ontem';
        return `${days} dia${days > 1 ? 's' : ''} atrás`;
    }
    if (hours > 0) return `${hours} hora${hours > 1 ? 's' : ''} atrás`;
    if (minutes > 0) return `${minutes} minuto${minutes > 1 ? 's' : ''} atrás`;
    if (seconds > 30) return `${seconds} segundo${seconds > 1 ? 's' : ''} atrás`;
    return 'Agora mesmo';
}

export function makeClickableLinks(text: string): string {
    if (!text) return '';
    
    // Converte [texto](URL) para links HTML
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        url = url.trim().replace(/[.,;!?]+$/, '');
        return `<a href="${url}" target="_blank">${text}</a>`;
    });
    
    return text.replace(/\n/g, '<br>');
}