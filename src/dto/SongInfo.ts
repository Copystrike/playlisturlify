class SongInfo {
    title: string; // Cleaned song title with artist names removed, remix/version info preserved
    artist: string[]; // Ordered list of all artists as they appear in the original title

    constructor(title: string, artist: string[]) {
        this.title = title;
        this.artist = artist;
    }
    

    static validate(obj: any): boolean {
        return (
            typeof obj.title === 'string' &&
            Array.isArray(obj.artist) &&
            obj.artist.every((a: any) => typeof a === 'string')
        );
    }
}

export { SongInfo };
