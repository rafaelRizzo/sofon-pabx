import { describe, it, expect } from 'bun:test'
import {
    isTrunkId, extensionNumberFrom, extensionNumberFromChannel,
    mapPeerPresence, mapDeviceState, mapQueueMemberStatus, memberInterfaceOf,
} from '../ami-events'

// Valores confirmados via AMI_DEBUG contra Asterisk real (ver conversa) — trava regressão contra
// os nomes/formatos de campo reais, não só o que a doc sugere.

describe('isTrunkId', () => {
    it('reconhece astId de tronco (contém "-trunk-")', () => {
        expect(isTrunkId('45d3a31d32-trunk-VOXDID-TESTE')).toBe(true)
    })

    it('não confunde número de ramal com tronco', () => {
        expect(isTrunkId('1000_45d3a31d32')).toBe(false)
    })
})

describe('extensionNumberFrom', () => {
    it('extrai o número de "TECH/numero"', () => {
        expect(extensionNumberFrom('SIP/2002_ast1')).toBe('2002_ast1')
        expect(extensionNumberFrom('PJSIP/1000_45d3a31d32')).toBe('1000_45d3a31d32')
    })

    it('é idempotente quando já vem sem prefixo (EndpointName do pjsip)', () => {
        expect(extensionNumberFrom('1000_45d3a31d32')).toBe('1000_45d3a31d32')
    })
})

describe('extensionNumberFromChannel', () => {
    it('remove o sufixo de sequência do nome de canal', () => {
        expect(extensionNumberFromChannel('PJSIP/2002_ast1-00000012')).toBe('2002_ast1')
    })

    it('retorna null sem separador de tech', () => {
        expect(extensionNumberFromChannel('garbage')).toBeNull()
    })
})

describe('mapPeerPresence', () => {
    it('mapeia PeerStatus/ContactStatus pra online/offline', () => {
        expect(mapPeerPresence('Registered')).toBe('online')
        expect(mapPeerPresence('Unregistered')).toBe('offline')
        expect(mapPeerPresence('Reachable')).toBe('online')
        expect(mapPeerPresence('Unreachable')).toBe('offline')
    })

    it('mapeia Status de OutboundRegistrationDetail (confirmado real)', () => {
        expect(mapPeerPresence('Registered')).toBe('online')
    })

    it('mapeia Status de SIPpeers/PeerEntry ("OK (5 ms)")', () => {
        expect(mapPeerPresence('OK (5 ms)')).toBe('online')
    })

    it('cai em unknown pra valor não reconhecido', () => {
        expect(mapPeerPresence('Lagged')).toBe('unknown')
        expect(mapPeerPresence(undefined)).toBe('unknown')
    })
})

describe('mapDeviceState', () => {
    it('mapeia o State de DeviceStateChange (formato com underscore)', () => {
        expect(mapDeviceState('NOT_INUSE')).toBe('idle')
        expect(mapDeviceState('INUSE')).toBe('in_call')
        expect(mapDeviceState('RINGING')).toBe('ringing')
        expect(mapDeviceState('RINGINUSE')).toBe('in_call')
        expect(mapDeviceState('ONHOLD')).toBe('in_call')
        expect(mapDeviceState('BUSY')).toBe('busy')
        expect(mapDeviceState('UNAVAILABLE')).toBe('unavailable')
    })

    it('mapeia o DeviceState textual de PJSIPShowEndpoints (confirmado real)', () => {
        expect(mapDeviceState('Not in use')).toBe('idle')
        expect(mapDeviceState('Unavailable')).toBe('unavailable')
    })
})

describe('mapQueueMemberStatus', () => {
    it('mapeia os códigos numéricos AST_DEVICE_* confirmados via QueueMember real', () => {
        expect(mapQueueMemberStatus('1')).toBe('idle')
        expect(mapQueueMemberStatus('2')).toBe('in_call')
        expect(mapQueueMemberStatus('3')).toBe('busy')
        expect(mapQueueMemberStatus('5')).toBe('unavailable')
        expect(mapQueueMemberStatus('6')).toBe('ringing')
    })

    it('cai em unknown pra código ausente/desconhecido', () => {
        expect(mapQueueMemberStatus(undefined)).toBe('unknown')
        expect(mapQueueMemberStatus('99')).toBe('unknown')
    })
})

describe('memberInterfaceOf', () => {
    it('usa Interface, confirmado real no QueueMemberStatus (Asterisk 22.7) — sem Location nenhum', () => {
        expect(memberInterfaceOf({
            Event: 'QueueMemberStatus', Queue: '45d3a31d32-600',
            Interface: 'PJSIP/1000_45d3a31d32', StateInterface: 'PJSIP/1000_45d3a31d32',
            Status: '1',
        })).toBe('PJSIP/1000_45d3a31d32')
    })

    it('cai pra Location quando Interface não vem (sub-evento QueueMember da action QueueStatus)', () => {
        expect(memberInterfaceOf({ Event: 'QueueMember', Queue: '45d3a31d32-600', Location: 'PJSIP/1000_45d3a31d32' }))
            .toBe('PJSIP/1000_45d3a31d32')
    })

    it('retorna undefined sem nenhum dos dois', () => {
        expect(memberInterfaceOf({ Event: 'QueueMemberStatus', Queue: '45d3a31d32-600' })).toBeUndefined()
    })
})
