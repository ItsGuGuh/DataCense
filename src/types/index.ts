export interface User {
    username: string;
    role: string;
    super?: boolean;
    permissions: string[];
    formattedName?: string;
}

export interface Post {
    id: number;
    username: string;
    titulo: string;
    post_image: string | null;
    post_description: string;
    post_type: 'texto' | 'imagem' | 'video';
    data_publicacao: Date;
    roles: string | null;
    OgtCheckMark: number;
    PostIsRead: number;
    Reacoes: number;
    Emoji1: number;
    Emoji2: number;
    Emoji3: number;
    Emoji4: number;
    Emoji5: number;
    data_final: Date | null;
    post_programado: number;
    author_name?: string;
    avatar_path?: string;
    isRead?: boolean;
    userReactions?: number;
}

export interface Avatar {
    id: number;
    title: string;
    arquivo: string;
    categoria: string;
    ordem: number;
}

export interface AvatarUser {
    id_avatar: number;
    username: string;
    data_escolha: Date;
    avatar_title?: string;
    avatar_file?: string;
}

export interface Notification {
    id: number;
    data_hora_criado: Date;
    remetente: string;
    remetente_formatado: string;
    icon: string;
    tipo: string;
    mensagem: string;
    destinatario: string;
    tipo_destinatario: 'usuario' | 'tag';
    visualizado: boolean;
    data_hora_visualizado: Date | null;
    tempo_relativo: string;
    usuarios_visualizacao?: string[];
}

export interface LoginHistory {
    day: number;
    date: Date;
    hasLogin: boolean;
    isHoliday?: boolean;
    holidayName?: string;
    isSunday?: boolean;
    isSaturday?: boolean;
}

export interface PatchNote {
    id: number;
    version: string;
    title: string;
    description: string;
    release_date: Date;
    is_important: number;
    items?: PatchNoteItem[];
}

export interface PatchNoteItem {
    id: number;
    patch_note_id: number;
    category: string;
    description: string;
}