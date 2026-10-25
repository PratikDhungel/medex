import { describe, expect, it } from 'vitest'
import { compareServiceTypes, serviceTypeLabel } from './serviceTypes'

describe('serviceTypeLabel', () => {
  it('labels known types in Title Case', () => {
    expect(serviceTypeLabel('lab_test')).toBe('Lab Tests')
    expect(serviceTypeLabel('package')).toBe('Packages')
  })

  it('derives a Title Case label for unknown types', () => {
    expect(serviceTypeLabel('home_visit')).toBe('Home Visit')
    expect(serviceTypeLabel(' tele-consult ')).toBe('Tele Consult')
  })
})

describe('compareServiceTypes', () => {
  it('sorts known types in display order and unknown ones last', () => {
    expect(['zeta', 'insurance', 'lab_test', 'package', 'alpha'].sort(compareServiceTypes)).toEqual([
      'package',
      'lab_test',
      'insurance',
      'alpha',
      'zeta',
    ])
  })
})
