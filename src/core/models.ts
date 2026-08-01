export const PLACEHOLDER = "NO DATA";

export interface Producer {
  id: string;
  name: string;
  original: string;
  developer: boolean;
  publisher: boolean;
}

export interface TitleEntry {
  lang?: string;
  title?: string;
  latin?: string;
}

export interface VNImage {
  url?: string;
  dims?: [number, number];
  sexual?: number;
  violence?: number;
  votecount?: number;
}

export interface MediaItem {
  medium?: string;
  qty?: number;
}

export interface VNRelease {
  id: string;
  title: string;
  alttitle: string | null;
  released: string;
  platforms: string[];
  languages: string[];
  producers: Producer[];
  media: MediaItem[];
}

export interface VNInfo {
  id: string;
  title: string;
  alttitle: string | null;
  titles: TitleEntry[];
  image: VNImage | null;
  releases: VNRelease[];
}

export interface VNCandidate {
  id: string;
  title: string;
  alttitle: string | null;
  titles: TitleEntry[];
}
