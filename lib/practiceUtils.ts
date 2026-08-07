export interface PracticeBucket {
  bucket_start_page: number
  bucket_end_page: number
}

export function getPracticeBucket(page: number, totalPages: number): PracticeBucket {
  const bucketStart = Math.floor((page - 1) / 3) * 3 + 1
  const naturalEnd = bucketStart + 2
  const bucketEnd = Math.min(naturalEnd, page, totalPages)

  return {
    bucket_start_page: bucketStart,
    bucket_end_page: bucketEnd,
  }
}