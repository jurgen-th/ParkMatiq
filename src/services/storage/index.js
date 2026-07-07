// Persistence boundary.
//
// Feature code imports storage exclusively through this module. The current
// implementation delegates to the localStorage-backed utility; swapping in a
// supabaseAdapter or apiAdapter later only touches this file, not the features.
export * from '../../utils/storage'
