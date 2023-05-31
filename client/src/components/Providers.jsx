//
// Copyright 2023 Perforce Software
//
import React from 'react'
import {
  Box,
  Card,
  CardActions,
  CardContent,
  Grid,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material'
import * as icons from '@mui/icons-material';
import { useNavigate } from 'react-router-dom'

const ActionsButton = ({ provider, onDelete }) => {
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = React.useState(null)
  const open = Boolean(anchorEl)
  const editUrl = `/${provider.protocol}/${provider.id}`

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleDelete = () => {
    onDelete(provider.id)
    setAnchorEl(null)
  }

  const handleTestLogin = () => {
    setAnchorEl(null)
    fetch(`/requests/new/test?providerId=${provider.id}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to get login URL (status ${response.status})`)
        }
        return response.json()
      })
      .then((response) => {
        window.open(response.loginTestUrl, '_blank')
      })
      .catch((err) => {
        console.error(err.message)
      })
  }

  return (
    <React.Fragment>
      <Tooltip title="Actions">
        <IconButton
          onClick={handleClick}
          size="small"
          sx={{ ml: 2 }}
        >
          <icons.MoreVert fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            '& .MuiAvatar-root': {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1,
            },
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleTestLogin}>
          <ListItemIcon>
            <icons.PlayArrow fontSize="small" />
          </ListItemIcon>
          Test Integration
        </MenuItem>
        <MenuItem onClick={() => navigate(editUrl)}>
          <ListItemIcon>
            <icons.Edit fontSize="small" />
          </ListItemIcon>
          Edit
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <ListItemIcon>
            <icons.Download fontSize="small" />
          </ListItemIcon>
          Download settings file
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <ListItemIcon>
            <icons.Delete fontSize="small" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </React.Fragment>
  )
}

const OidcProviderCard = ({ provider, onDelete }) => {
  return (
    <Card sx={{ minWidth: 275, height: "100%" }}>
      <CardContent>
        <Typography>
          {provider.label}
        </Typography>
        <Typography variant="subtitle2">
          Issuer URI:
        </Typography>
        <Typography>
          {provider.issuerUri}
        </Typography>
        <Typography variant="subtitle2">
          Protocol:
        </Typography>
        <Typography variant="overline">
          {provider.protocol}
        </Typography>
      </CardContent>
      <CardActions>
        <ActionsButton provider={provider} onDelete={onDelete} />
      </CardActions>
    </Card>
  )
}

const SamlProviderCard = ({ provider, onDelete }) => {
  return (
    <Card sx={{ minWidth: 275, height: "100%" }}>
      <CardContent>
        <Typography>
          {provider.label}
        </Typography>
        <Typography variant="subtitle2">
          Metadata URL:
        </Typography>
        <Typography>
          {provider.metadataUrl}
        </Typography>
        <Typography variant="subtitle2">
          Protocol:
        </Typography>
        <Typography variant="overline">
          {provider.protocol}
        </Typography>
      </CardContent>
      <CardActions>
        <ActionsButton provider={provider} onDelete={onDelete} />
      </CardActions>
    </Card>
  )
}

const ProviderCard = ({ provider, onDelete }) => {
  return provider.protocol === 'oidc' ?
    OidcProviderCard({ provider, onDelete }) :
    SamlProviderCard({ provider, onDelete })
}

export default function Providers({ providers, onDelete }) {
  return (
    <Box>
      <Typography>
        Authentication Integrations
      </Typography>
      <Grid container spacing={2}>
        {providers.map((p) => (
          <Grid item xs={4} key={p.id}>
            <ProviderCard provider={p} onDelete={onDelete} />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
