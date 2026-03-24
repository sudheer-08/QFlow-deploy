/**
 * Pagination utilities for list endpoints
 * Provides consistent pagination across all list endpoints
 */

/**
 * Parse pagination parameters from query string
 * @param {object} query - Express query object
 * @returns {object} {page, pageSize, from, to} for use with Supabase .range()
 */
const getPaginationParams = (query = {}) => {
  const page = Math.max(Number.parseInt(query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(Number.parseInt(query.pageSize || '20', 10), 1), 100); // Max 100 items per page
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  return { page, pageSize, from, to };
};

/**
 * Format pagination metadata for response
 * @param {number} page - Current page
 * @param {number} pageSize - Items per page
 * @param {number} total - Total item count (if known)
 * @returns {object} Pagination metadata
 */
const getPaginationMeta = (page, pageSize, total = null) => {
  const meta = {
    page,
    pageSize,
    hasMore: total === null ? null : (page * pageSize) < total
  };
  
  if (total !== null) {
    meta.totalPages = Math.ceil(total / pageSize);
    meta.totalItems = total;
  }
  
  return meta;
};

/**
 * Standard response format for paginated results
 * @param {array} data - Array of items
 * @param {object} pagination - Pagination object from getPaginationParams
 * @param {number} total - Total item count (optional)
 * @returns {object} {success, data, pagination}
 */
const paginate = (data = [], pagination, total = null) => {
  return {
    success: true,
    data,
    pagination: getPaginationMeta(pagination.page, pagination.pageSize, total)
  };
};

module.exports = {
  getPaginationParams,
  getPaginationMeta,
  paginate
};
