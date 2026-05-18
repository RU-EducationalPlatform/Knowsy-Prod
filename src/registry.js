// Single source of truth for the Knowsy-Prod widget catalog.
//
// Production runtime ships only two widgets: the solar system and the
// periodic table. Both render via a dedicated HTML page (see `page`
// below); the catalog routes to that page rather than dynamic-importing
// a class. `src`/`exportName`/`mountId` remain on the entry for shape
// compatibility with src/app.js, but they are unused at runtime.

export const CATEGORIES = ['Astronomy', 'Chemistry'];

/** @type {Array<{ id:string, category:string, label:string, description:string, mountId:string, src:string, exportName:string, ctorArgs:any[], page?:string, audience?:string }>} */
export const WIDGETS = [
    {
        id: 'webgl-solar-system',
        category: 'Astronomy',
        label: 'Solar system',
        description: 'Fly between the planets — Three.js scene with editorial info cards',
        mountId: 'webgl-solar-system-target',
        src: '',
        exportName: '',
        ctorArgs: [],
        page: './solar-system.html',
    },
    {
        id: 'periodic-table',
        category: 'Chemistry',
        label: 'Periodic table',
        description: 'All 118 elements — colour-by-property, click for full dossier, animated electron shells',
        mountId: 'periodic-table-target',
        src: '',
        exportName: '',
        ctorArgs: [],
        page: './periodic-table.html',
    },
];
